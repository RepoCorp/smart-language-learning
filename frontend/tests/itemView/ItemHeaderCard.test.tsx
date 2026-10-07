import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import ItemHeaderCard from "../../src/components/itemView/ItemHeaderCard";
import { ItemHeading, ItemTitle, ItemSubtitle } from "../../src/components/itemView/ItemHeading";
import { ItemMetadata, ItemMetadataField, ItemType, ItemTypeDescription, ItemNotes } from "../../src/components/itemView/ItemMetadata";

it("renders supplied type and notes in the common metadata layout", () => {
  const { container } = render(<ItemHeaderCard>
    <ItemHeading><ItemTitle>Example</ItemTitle></ItemHeading>
    <ItemMetadata>
      <ItemType label="Type">Custom type</ItemType>
      <ItemNotes label="Notes">An explanation.</ItemNotes>
    </ItemMetadata>
  </ItemHeaderCard>);
  expect(container.querySelectorAll(".item-view-meta-grid")).toHaveLength(1);
  expect(container.querySelectorAll(".item-view-meta-card")).toHaveLength(2);
  expect(screen.getByText("Custom type")).toHaveClass("item-view-meta-value");
  expect(screen.getByText("An explanation.")).toHaveClass("item-view-meta-value-notes");
  expect(container.querySelector(".item-view-type-description")).toBeNull();
});

it("keeps an optional type description separate from the item notes", () => {
  render(<ItemHeaderCard>
    <ItemHeading><ItemTitle>Example</ItemTitle></ItemHeading>
    <ItemMetadata>
      <ItemType label="Type" description={<ItemTypeDescription>About this kind of item.</ItemTypeDescription>}>Custom type</ItemType>
      <ItemNotes label="Notes">About this particular item.</ItemNotes>
    </ItemMetadata>
  </ItemHeaderCard>);
  expect(screen.getByText("About this kind of item.")).toHaveClass("item-view-type-description");
  expect(screen.getByText("About this particular item.")).toHaveClass("item-view-meta-value-notes");
});

it("does not invent metadata when none is provided", () => {
  const { container } = render(<ItemHeaderCard><ItemHeading><ItemTitle>Example</ItemTitle></ItemHeading></ItemHeaderCard>);
  expect(container.querySelector(".item-view-meta-grid")).toBeNull();
});

it("allows either section independently and preserves supplied labels", () => {
  const { rerender } = render(<ItemHeaderCard>
    <ItemMetadata><ItemNotes label="Notas">Explanation</ItemNotes></ItemMetadata>
  </ItemHeaderCard>);
  expect(screen.getByText("Notas")).toBeInTheDocument();
  expect(screen.queryByText("Type")).not.toBeInTheDocument();
  rerender(<ItemHeaderCard>
    <ItemMetadata><ItemType label="Tipo">Sufijo</ItemType></ItemMetadata>
  </ItemHeaderCard>);
  expect(screen.getByText("Tipo")).toBeInTheDocument();
  expect(screen.getByText("Sufijo")).toBeInTheDocument();
  expect(screen.queryByText("Notas")).not.toBeInTheDocument();
});

it("renders a view's composition in order without requiring type or notes", () => {
  const { container } = render(<ItemHeaderCard>
    <ItemHeading><ItemTitle><em>Custom title</em></ItemTitle><ItemSubtitle>Translation</ItemSubtitle></ItemHeading>
    <ItemMetadata><ItemMetadataField label="Pronunciation"><span>Custom content</span></ItemMetadataField></ItemMetadata>
    <button>Custom action</button>
  </ItemHeaderCard>);
  expect(screen.getByRole("heading", { name: "Custom title" }).querySelector("em")).not.toBeNull();
  expect(screen.getByText("Translation")).toHaveClass("item-view-subtitle");
  expect(container.querySelectorAll(".item-view-meta-card")).toHaveLength(1);
  expect(screen.queryByText("Type")).not.toBeInTheDocument();
  expect(container.querySelector(".item-view-header-card")?.lastElementChild).toBe(screen.getByRole("button", { name: "Custom action" }));
});
