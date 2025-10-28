import Head from "next/head";
import fs from "fs";
import path from "path";

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), "index.html");
  const html = fs.readFileSync(filePath, "utf8");
  return { props: { html } };
}

export default function Home({ html }) {
  return (
    <>
      <Head>
        <title>OpenSea.io</title>
        <script src="/jquery-3.7.1.min.js"></script>
      </Head>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
