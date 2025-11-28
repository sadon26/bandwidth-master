import React, { useState } from "react";
import { uploadFile } from "../api";
import { useNavigate } from "react-router";

export default function UploadForm() {
  const navigate = useNavigate();

  return (
    <div className="p-4 bg-white rounded shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1 bg-sky-600 text-white rounded"
          onClick={() => navigate("/upload")}
        >
          Upload
        </button>
      </div>
    </div>
  );
}
