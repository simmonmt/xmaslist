export class ItemLink {
    constructor(private readonly name: string,
		private readonly url: string) {
    }

    clone() {
        return new ItemLink(this.name, this.url);
    }
}

export class ListItem {
    constructor(private readonly id: string,
		private readonly version: number,
		private readonly name: string,
		private readonly description: string,
		private readonly links: ItemLink[],
		private readonly claimed: boolean) {
    }

    clone() {
        return new ListItem(
            this.id,
            this.version,
            this.name,
            this.description,
            this.links.map((link) => link.clone()),
            this.claimed);
    }
}
