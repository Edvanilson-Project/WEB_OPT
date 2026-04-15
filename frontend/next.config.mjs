const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
	reactStrictMode: true,
	output: 'standalone',
	// Evita colisao entre `next dev` e `next build`/`next start` no mesmo `.next`.
	// Nesta base o frontend e os checks de build rodam em paralelo com frequencia.
	distDir: isDev ? '.next-dev' : '.next',
};

export default nextConfig;
