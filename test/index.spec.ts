import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

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
		expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 4)]).toEqual(PNG_MAGIC);
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
