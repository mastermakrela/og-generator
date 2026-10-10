declare module '*.bin' {
	const content: ArrayBuffer;
	export default content;
}

type FontDef = Omit<import('@cf-wasm/satori/workerd').Font, 'data'> & {
	data: string;
};

type ImageRequest = {
	html: string;
	height?: number;
	width?: number;
};
