import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { html as to_react_node } from 'satori-html';
import satori, { Font, init } from 'satori/wasm';
import initYoga from 'yoga-wasm-web';

import backup_noto from './noto-sans-v27-latin-regular.ttf';
import resvg_wasm from '@resvg/resvg-wasm/index_bg.wasm';
import yoga_wasm from 'yoga-wasm-web/dist/yoga.wasm';

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

async function prepare_fonts(env: Env, html: string): Promise<Font[]> {
	const _fonts = fonts
		.filter((font) => html.includes(font.name))
		.flatMap((font) => font.files)
		.map(async (file) => {
			const data = await env.FONTS.get(file.data).then((res) => res?.arrayBuffer());

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
				data: await backup_noto,
				weight: 700,
				style: 'normal',
			},
		];
	}

	return ret;
}

// MARK: - Default

export default class extends WorkerEntrypoint<Env> {
	// async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	async fetch(request: Request) {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		const img_req = (await request.json()) as ImageRequest;

		if (!img_req.html) {
			return new Response('Missing html', { status: 400 });
		}

		const image = await new ImageGenerator(this.ctx, this.env).get_png(img_req);

		return new Response(image, {
			headers: {
				'Content-Type': 'image/png',
				'Content-Length': image.length.toString(),
			},
		});
	}

	async get_png({ html, width = 1200, height = 600 }: ImageRequest) {
		if (!html) {
			throw new Error('Missing html');
		}

		// await initYoga(yoga_wasm).then(init);
		// await initWasm(resvg_wasm);

		const react = to_react_node(html);

		const svg = await satori(react, {
			height,
			width,
			fonts: await prepare_fonts(this.env, html),
		});

		const resvg = new Resvg(svg, {
			fitTo: {
				mode: 'width',
				value: width,
			},
		});

		const image = resvg.render();

		return image.asPng();
	}
}

// MARK: - ImageGenerator

try {
	initYoga(yoga_wasm).then(init);
	initWasm(resvg_wasm);
} catch (error) {
	console.log('🚀 ~ error:', error);
}
export class ImageGenerator extends WorkerEntrypoint<Env> {
	async get_png({ html, width = 1200, height = 600 }: ImageRequest) {
		if (!html) {
			throw new Error('Missing html');
		}

		// await initYoga(yoga_wasm).then(init);
		// await initWasm(resvg_wasm);

		const react = to_react_node(html);

		const svg = await satori(react, {
			height,
			width,
			fonts: await prepare_fonts(this.env, html),
		});

		const resvg = new Resvg(svg, {
			fitTo: {
				mode: 'width',
				value: width,
			},
		});

		const image = resvg.render();

		return image.asPng();
	}
}
