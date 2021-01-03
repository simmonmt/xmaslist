import * as LoremIpsum from "lorem-ipsum";
import { ItemLink, ListItem } from "./list_item";

const lorem = new LoremIpsum.LoremIpsum();

function delay(t) {
    return new Promise(function(resolve) {
	setTimeout(resolve, t)
    });
}

export class ItemModel {
    private readonly items: Map<string, ListItem>;

    constructor() {
        this.items = new Map<string, ListItem>([
	    ["id1", new ListItem("id1", 1,
                                 lorem.generateWords(5),
                                 lorem.generateParagraphs(1),
                                 [new ItemLink("Amazon", "http://amazon/id1")],
                                 false)],
            ["id2", new ListItem("id2", 1,
                                 lorem.generateWords(5),
                                 lorem.generateParagraphs(1),
                                 [new ItemLink("Amazon", "http://amazon/id2"),
                                  new ItemLink("Walmart", "http://walmart/id2")],
                                 true)],
            ["id3", new ListItem("id3", 1,
                                 lorem.generateWords(5),
                                 lorem.generateParagraphs(1),
                                 [],
                                 false)],
	]);
    }

    loadItems(): Promise<string[]> {
        return delay(1*1000)
            .then(() => {
                return Promise.resolve(Array.from(this.items.keys()));
            });
    }

    getItemById(id): ListItem {
        return this.items[id];
    }

    setClaimState(id, claimed): Promise<ListItem> {
        const item = this.items[id];
        if (item === undefined) {
            console.log("Attempt to claim nonexistent item", id);
            return;
        }

        if (item.claimed === claimed) {
            console.log("Redundant item claim state change", id);
        }

        const copy = item.clone();
        copy.claimed = claimed;
        return delay(1*1000)
            .then(() => {
                this.items[id] = copy;
                return Promise.resolve(copy);
            });
    }
}
