import { env, exports } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import font from '../src/noto-sans-v27-latin-regular.ttf.bin';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const html = '<div style="display: flex; font-size: 40px;">Hello Baltia</div>';

describe('fetch', () => {
	it('renders a PNG', async () => {
		const response = await exports.default.fetch('https://og.test/', {
			method: 'POST',
			body: JSON.stringify({ html, width: 400, height: 200 }),
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		const png = new DataView(await response.arrayBuffer());
		expect([0, 1, 2, 3].map((i) => png.getUint8(i))).toEqual(PNG_MAGIC);
		// IHDR width and height: the image has the requested size.
		expect([png.getUint32(16), png.getUint32(20)]).toEqual([400, 200]);
	});

	it('rejects non-POST requests', async () => {
		const response = await exports.default.fetch('https://og.test/');
		expect(response.status).toBe(405);
	});

	it('rejects a request without html', async () => {
		const response = await exports.default.fetch('https://og.test/', { method: 'POST', body: '{}' });
		expect(response.status).toBe(400);
	});
});

describe('ImageGenerator', () => {
	it('renders a PNG over RPC', async () => {
		const image = await exports.ImageGenerator.get_png({ html, width: 400, height: 200 });

		expect(image).toBeInstanceOf(Uint8Array);
		expect([...image.slice(0, 4)]).toEqual(PNG_MAGIC);
	});
});

describe('fonts', () => {
	it('loads a font named in the html from R2, and picks up a file uploaded after a miss', async () => {
		const warn = vi.spyOn(console, 'warn');
		const req = { html: `<div style="display: flex; font-family: 'Noto Serif';">Hello Baltia</div>`, width: 400, height: 200 };

		await exports.ImageGenerator.get_png(req);
		expect(warn).toHaveBeenCalledWith('No fonts found in the html, using backup font');

		warn.mockClear();
		await env.FONTS.put('Noto_Serif/static/NotoSerif-Regular.ttf', font);
		await exports.ImageGenerator.get_png(req);
		expect(warn).not.toHaveBeenCalledWith('No fonts found in the html, using backup font');

		warn.mockRestore();
	});
});
