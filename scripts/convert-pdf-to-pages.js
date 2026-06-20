const fs = require("fs");
const path = require("path");
const { convert } = require("pdf-poppler");

const ROOT_DIR = path.join(__dirname, "..");

const LANG_CONFIG = {
  english: {
    label: "English",
    defaultPdf: "C:/Users/MDSAHI~1/Downloads/quran-english.pdf",
  },
  "roman-urdu": {
    label: "Roman Urdu",
    defaultPdf: "C:/Users/MDSAHI~1/Downloads/quran-roman-urdu.pdf",
  },
};

function getArgument(name, fallback) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function emptyDirectory(directory) {
  await fs.promises.rm(directory, { recursive: true, force: true });
  await fs.promises.mkdir(directory, { recursive: true });
}

async function main() {
  const lang = getArgument("lang", "english");

  const config = LANG_CONFIG[lang];
  if (!config) {
    throw new Error(`Unknown language: ${lang}. Supported: ${Object.keys(LANG_CONFIG).join(", ")}`);
  }

  const pdfPath = path.resolve(getArgument("pdf", config.defaultPdf));
  if (!fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }

  const pagesDir = path.join(ROOT_DIR, lang, "pages");
  const manifestPath = path.join(ROOT_DIR, "manifest.json");

  await emptyDirectory(pagesDir);

  await convert(pdfPath, {
    format: "png",
    out_dir: pagesDir,
    out_prefix: "page",
    page: null,
    scale: 1200,
  });

  const pngFiles = (await fs.promises.readdir(pagesDir))
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (let index = 0; index < pngFiles.length; index += 1) {
    const pageNumber = String(index + 1).padStart(3, "0");
    const currentPath = path.join(pagesDir, pngFiles[index]);
    const nextPath = path.join(pagesDir, `page-${pageNumber}.png`);

    if (currentPath !== nextPath) {
      await fs.promises.rename(currentPath, nextPath);
    }

    console.log(`[${config.label}] Prepared page ${index + 1}/${pngFiles.length}`);
  }

  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
  manifest.version = new Date().toISOString().slice(0, 10);
  manifest.languages[lang] = manifest.languages[lang] || {};
  manifest.languages[lang].totalPages = pngFiles.length;
  manifest.languages[lang].label = config.label;
  manifest.languages[lang].baseUrl = `https://cdn.jsdelivr.net/gh/SahilHasnain/quran-reader-assets@main/${lang}/pages`;
  manifest.languages[lang].filePattern = "page-{page}.png";
  manifest.languages[lang].extension = "png";
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`[${config.label}] Converted ${pngFiles.length} pages to ${pagesDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
