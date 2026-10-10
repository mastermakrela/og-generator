// @cf-wasm/* load satori's and resvg's WASM on Workers. They hold satori at 0.32.0, because
// 0.33+ bundles HarfBuzz WASM that can't load there (fineshopdesign/cf-wasm#100).
import { Resvg } from '@cf-wasm/resvg/workerd';
import satori, { type Font } from '@cf-wasm/satori/workerd';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { html as to_react_node } from 'satori-html';

import backup_noto from './noto-sans-v27-latin-regular.ttf.bin';

// MARK: - Fonts

const fonts = [
	{
		name: 'Noto Serif',
		files: [
			{ name: 'Noto Serif', data: 'Noto_Serif/static/NotoSerif-Regular.ttf', style: 'normal', weight: 400 },
			{ name: 'Noto Serif', data: 'Noto_Serif/static/NotoSerif-Bold.ttf', style: 'normal', weight: 700 },
		] as FontDef[],
	},
	{
		name: 'Comfortaa',
		files: [{ name: 'Comfortaa', data: 'Comfortaa/static/Comfortaa-Regular.ttf', style: 'normal', weight: 400 }] as FontDef[],
	},
];

// Keyed by R2 path. Holds the in-flight promise so concurrent requests share one fetch,
// and hands out the same buffer every time, which also hits satori's parsed-font cache.
const font_cache = new Map<string, Promise<ArrayBuffer | undefined>>();

function load_font(env: Env, path: string) {
	let font = font_cache.get(path);

	if (!font) {
		font = env.FONTS.get(path).then((res) => res?.arrayBuffer());
		font_cache.set(path, font);
		// Misses and errors aren't cached, so a font uploaded later gets picked up.
		font.then(
			(data) => data ?? font_cache.delete(path),
			() => font_cache.delete(path),
		);
	}

	return font;
}

async function prepare_fonts(env: Env, html: string): Promise<Font[]> {
	const _fonts = fonts
		.filter((font) => html.includes(font.name))
		.flatMap((font) => font.files)
		.map(async (file) => {
			const data = await load_font(env, file.data);

			if (!data) {
				console.warn(`Font file ${file.data} not found`);
				return null;
			}

			return { ...file, data: data };
		});

	const ret = await Promise.all(_fonts).then((fonts) => fonts.filter(Boolean));

	if (ret.length === 0) {
		console.warn('No fonts found in the html, using backup font');
		return [
			{
				name: 'sans serif',
				data: backup_noto,
				weight: 700,
				style: 'normal',
			},
		];
	}

	return ret;
}

// MARK: - Rendering

async function render_png(env: Env, { html, width = 1200, height = 600 }: ImageRequest) {
	if (!html) {
		throw new Error('Missing html');
	}

	const svg = await satori(to_react_node(html), { height, width, fonts: await prepare_fonts(env, html) });

	const resvg = await Resvg.async(svg, {
		fitTo: {
			mode: 'width',
			value: width,
		},
	});

	// Free the WASM-side SVG tree and pixmap right away instead of waiting for GC; `asPng()` returns a JS-owned copy.
	try {
		const image = resvg.render();
		try {
			return image.asPng();
		} finally {
			image.free();
		}
	} finally {
		resvg.free();
	}
}

// MARK: - Default

export default class extends WorkerEntrypoint<Env> {
	async fetch(request: Request) {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const img_req = await request.json<ImageRequest>();

		if (!img_req.html) {
			return new Response('Missing html', { status: 400 });
		}

		const image = await render_png(this.env, img_req);

		return new Response(image, {
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': image.length.toString(),
			},
		});
	}
}

// MARK: - ImageGenerator

export class ImageGenerator extends WorkerEntrypoint<Env> {
	async get_png(req: ImageRequest) {
		return render_png(this.env, req);
	}
}
