import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Converted App</title>
      </Head>
      <iframe src="/index.html" style={{ width: '100%', height: '100vh', border: 0 }} title="Original App" />
    </>
  );
}
