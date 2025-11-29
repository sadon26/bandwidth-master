import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function CompressionChart({
  originalSize,
  compressedSize,
  bitrate,
}: {
  originalSize: number; // in bytes
  compressedSize: number; // in bytes
  bitrate: string; // "800k", "1M"
}) {
  const originalMB = originalSize / 1024 / 1024;
  const compressedMB = compressedSize / 1024 / 1024;
  const saved = originalMB - compressedMB;
  const percent = ((saved / originalMB) * 100).toFixed(1);

  const data = {
    labels: ["Original", "Compressed"],
    datasets: [
      {
        label: "File Size (MB)",
        data: [originalMB, compressedMB],
        backgroundColor: ["#1d4ed8", "orange"],
        borderRadius: 8,
        barThickness: 30,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => context.raw.toFixed(2) + " MB",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "Megabytes" },
      },
      x: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-xl mb-4">
      <h2 className="text-sm text-center font-semibold mb-4">
        Compression Results
      </h2>

      <Bar data={data} options={options} />

      <div className="mt-6 text-xs flex flex-col items-center text-slate-700">
        <p>
          <strong>Original Size:</strong> {originalMB.toFixed(2)} MB
        </p>
        <p>
          <strong>Compressed Size:</strong> {compressedMB.toFixed(2)} MB
        </p>
        <p>
          <strong>Bitrate Used:</strong> {bitrate}
          {" / "}
          {Number(bitrate.slice(0, -1)) / 1000} MB
        </p>
        <p>
          <strong>Space Saved:</strong> {saved.toFixed(2)} MB ({percent}%)
        </p>
      </div>
    </div>
  );
}
