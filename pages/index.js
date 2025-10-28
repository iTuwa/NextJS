import Head from "next/head";
import fs from "fs";
import path from "path";

export async function getStaticProps() {
  // 👇 Read from the public folder instead of project root
  const filePath = path.join(process.cwd(), "public", "index.html");
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
