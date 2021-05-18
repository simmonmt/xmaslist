export class ItemLink {
  constructor(public readonly name: string, public readonly url: string) {}

  clone() {
    return new ItemLink(this.name, this.url);
  }
}

export class ListItem {
  constructor(
    public readonly id: string,
    public readonly version: number,
    public readonly name: string,
    public readonly description: string,
    public readonly links: ItemLink[],
    public readonly claimed: boolean
  ) {}
}

export class ListItemBuilder {
  private claimed: boolean | undefined = undefined;

  constructor(private readonly base: ListItem) {}

  setClaimed(claimed: boolean): ListItemBuilder {
    this.claimed = claimed;
    return this;
  }

  build(): ListItem {
    let claimed = this.claimed === undefined ? this.base.claimed : this.claimed;

    return new ListItem(
      this.base.id,
      this.base.version,
      this.base.name,
      this.base.description,
      this.base.links.map((link) => link.clone()),
      claimed
    );
  }
}
