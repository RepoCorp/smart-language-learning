import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ItemViewHeader from "../../src/components/ItemViewHeader";
import { ItemHeading, ItemTitle } from "../../src/components/itemView/ItemHeading";

it("renders supplied content and optional audio without item or language data", () => {
  const { container, rerender } = render(<ItemViewHeader audio={{ url: "/example.mp3", unavailableLabel: "Audio unavailable" }}>
    <ItemHeading><ItemTitle>Any title</ItemTitle></ItemHeading>
  </ItemViewHeader>);
  expect(screen.getByRole("heading", { name: "Any title" })).toBeInTheDocument();
  expect(container.querySelector("audio")).toHaveAttribute("src", "/example.mp3");
  expect(container.querySelector("audio")).toHaveAttribute("controls");
  expect(container.querySelector("audio")).toHaveTextContent("Audio unavailable");
  expect(container.querySelector(".item-view-header-card audio")).toBeNull();
  rerender(<ItemViewHeader><p>Another composition</p></ItemViewHeader>);
  expect(container.querySelector("audio")).toBeNull();
  expect(container.querySelector(".item-view-meta-grid")).toBeNull();
  expect(screen.getByText("Another composition")).toBeInTheDocument();
});

it("does not create an audio player for an empty URL", () => {
  const { container } = render(<ItemViewHeader audio={{ url: "", unavailableLabel: "Audio unavailable" }}>Content</ItemViewHeader>);
  expect(container.querySelector("audio")).toBeNull();
});
