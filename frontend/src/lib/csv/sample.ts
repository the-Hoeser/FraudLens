import { FEATURE_COLUMNS } from "@/lib/api/types";
import { mulberry32, normal } from "@/lib/demo/prng";

/**
 * SYNTHETIC sample in the ULB schema: random values, not real transactions and not drawn
 * from the dataset. Useful to check that upload and validation work end-to-end.
 */
export function generateSampleCsv(rows = 25, seed = 7): string {
  const rand = mulberry32(seed);
  const header = [...FEATURE_COLUMNS, "Class"].join(",");
  const lines = [header];
  let time = 0;
  for (let i = 0; i < rows; i++) {
    time += Math.floor(rand() * 120);
    const values = FEATURE_COLUMNS.map((col) => {
      if (col === "Time") return String(time);
      if (col === "Amount") return Math.exp(3 + normal(rand)).toFixed(2);
      return normal(rand).toFixed(6);
    });
    lines.push([...values, "0"].join(","));
  }
  return lines.join("\n") + "\n";
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}