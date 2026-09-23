/** @jest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import ConvertOptionsPanel from "@/components/ConvertOptions";
import type { ConvertOptions } from "@/types/client";

const base: ConvertOptions = {
  targetFormat: "webp", quality: 85, resizeWidth: 800, resizeHeight: null, maintainAspectRatio: true, removeMetadata: false,
};

function setup(options: ConvertOptions = base) {
  const onChange = jest.fn();
  render(<ConvertOptionsPanel sourceFormat={null} options={options} onChange={onChange} />);
  return onChange;
}

it("emits every option change with the rest of the options preserved", () => {
  const onChange = setup();
  const last = () => onChange.mock.calls.at(-1)![0];

  fireEvent.click(screen.getByText("PNG"));
  expect(last()).toMatchObject({ targetFormat: "png", quality: 85 });

  fireEvent.change(screen.getByLabelText("Quality"), { target: { value: "40" } });
  expect(last().quality).toBe(40);
  fireEvent.change(screen.getByLabelText("Width (px)"), { target: { value: "320" } });
  expect(last().resizeWidth).toBe(320);
  fireEvent.change(screen.getByLabelText("Height (px)"), { target: { value: "" } });
  expect(last().resizeHeight).toBeNull();
  fireEvent.click(screen.getByLabelText("Maintain aspect ratio"));
  expect(last().maintainAspectRatio).toBe(false);
  fireEvent.click(screen.getByLabelText(/Allow upscaling/));
  expect(last().allowUpscaling).toBe(true);
  fireEvent.click(screen.getByLabelText(/Remove metadata/));
  expect(last().removeMetadata).toBe(true);

  fireEvent.click(screen.getByText("Advanced options"));
  fireEvent.change(screen.getByLabelText("Rotate (degrees)"), { target: { value: "90" } });
  expect(last().rotate).toBe(90);
  fireEvent.change(screen.getByLabelText(/Blur/), { target: { value: "2" } });
  expect(last().blur).toBe(2);
  for (const [label, key] of [
    ["Grayscale", "grayscale"], ["Flip horizontal", "flip"], ["Flip vertical", "flop"],
    ["Sharpen", "sharpen"], ["Normalize contrast", "normalize"], ["Trim borders", "trim"],
  ] as const) {
    fireEvent.click(screen.getByLabelText(label));
    expect(last()[key]).toBe(true);
  }
});

it("disables quality for formats that ignore it", () => {
  setup({ ...base, targetFormat: "png" });
  expect(screen.getByLabelText("Quality")).toBeDisabled();
  expect(screen.getByText(/not applicable for PNG/)).toBeInTheDocument();
});
