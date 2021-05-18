import * as LoremIpsum from "lorem-ipsum";
import { ItemLink, ListItem, ListItemBuilder } from "./list_item";

const lorem = new LoremIpsum.LoremIpsum();

function delay(t: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, t);
  });
}

export class ItemModel {
  private readonly items: Map<string, ListItem>;

  constructor() {
    this.items = new Map<string, ListItem>([
      [
        "id1",
        new ListItem(
          "id1",
          1,
          lorem.generateWords(5),
          lorem.generateParagraphs(1),
          [new ItemLink("Amazon", "http://amazon/id1")],
          false
        ),
      ],
      [
        "id2",
        new ListItem(
          "id2",
          1,
          lorem.generateWords(5),
          lorem.generateParagraphs(1),
          [
            new ItemLink("Amazon", "http://amazon/id2"),
            new ItemLink("Walmart", "http://walmart/id2"),
          ],
          true
        ),
      ],
      [
        "id3",
        new ListItem(
          "id3",
          1,
          lorem.generateWords(5),
          lorem.generateParagraphs(1),
          [],
          false
        ),
      ],
    ]);
  }

  loadItems(): Promise<string[]> {
    return delay(1 * 1000).then(() => {
      return Promise.resolve(Array.from(this.items.keys()));
    });
  }

  getItemById(id: string): ListItem|undefined {
    return this.items.get(id);
  }

  setClaimState(id: string, claimed: boolean): Promise<ListItem> {
    const item = this.items.get(id);
    if (item === undefined) {
      return Promise.reject(new Error(`Attempt to claim nonexistent item ${id}`));
    }

    if (item.claimed === claimed) {
      return Promise.reject(new Error(`Redundant item claim state change ${id}`));
    }

    const copy = new ListItemBuilder(item).setClaimed(claimed).build();
    return delay(1 * 1000).then(() => {
      this.items.set(id, copy);
      return Promise.resolve(copy);
    });
  }
}
