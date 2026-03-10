/** @jest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageConverter from "@/components/ImageConverter";

// jsdom doesn't implement URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", { value: jest.fn(() => "blob:mock-url"), writable: true });
Object.defineProperty(URL, "revokeObjectURL", { value: jest.fn(), writable: true });

function createSuccessResponse(): Response {
  const headers = new Headers({
    "X-Output-Filename": "photo.webp",
    "X-Output-Size": "1000",
    "Content-Type": "image/webp",
  });
  return {
    ok: true,
    status: 200,
    headers,
    blob: jest.fn().mockResolvedValue(new Blob(["out"], { type: "image/webp" })),
  } as unknown as Response;
}

function createErrorResponse(message = "Conversion failed", error = "CONVERSION_FAILED"): Response {
  return {
    ok: false,
    status: 422,
    headers: new Headers(),
    json: jest.fn().mockResolvedValue({ message, error }),
  } as unknown as Response;
}

function makeFile(name = "photo.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])], name, { type });
}

describe("ImageConverter React state machine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("items start pending after file selection", async () => {
    render(<ImageConverter />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeFile());
    expect(await screen.findByText("Pending")).toBeInTheDocument();
  });

  it("status transitions pending → converting → done on successful fetch", async () => {
    global.fetch = jest.fn().mockResolvedValue(createSuccessResponse());
    render(<ImageConverter />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeFile());
    await userEvent.click(screen.getByText("Convert All"));
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument(), { timeout: 5000 });
  });

  it("status transitions pending → converting → error on failed fetch", async () => {
    global.fetch = jest.fn().mockResolvedValue(createErrorResponse());
    render(<ImageConverter />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeFile());
    await userEvent.click(screen.getByText("Convert All"));
    await waitFor(() => expect(screen.getByText("Failed")).toBeInTheDocument(), { timeout: 5000 });
  });

  it("one failure doesn't block others", async () => {
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1 ? createErrorResponse() : createSuccessResponse());
    });
    render(<ImageConverter />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, [makeFile("a.jpg"), makeFile("b.jpg")]);
    await userEvent.click(screen.getByText("Convert All"));
    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it("p-limit concurrency cap — all 8 items eventually complete", async () => {
    global.fetch = jest.fn().mockResolvedValue(createSuccessResponse());
    render(<ImageConverter />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = Array.from({ length: 8 }, (_, i) => makeFile(`photo${i + 1}.jpg`));
    await userEvent.upload(fileInput, files);
    await userEvent.click(screen.getByText("Convert All"));
    await waitFor(() => {
      const doneItems = screen.getAllByText("Done");
      expect(doneItems.length).toBe(8);
    }, { timeout: 10000 });
  });
});
