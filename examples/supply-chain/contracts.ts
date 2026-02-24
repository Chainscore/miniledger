/**
 * Supply Chain Tracking Contract
 *
 * Tracks products from creation through multiple waypoints to delivery.
 * State keys: "product:<id>" -> ProductRecord
 */
export const SUPPLY_CHAIN_CONTRACT = `
return {
  createProduct(ctx, id, name, origin) {
    const key = "product:" + id;
    if (ctx.get(key)) throw new Error("Product already exists: " + id);
    ctx.set(key, {
      id: id,
      name: name,
      origin: origin,
      owner: ctx.sender,
      status: "created",
      history: [{ action: "created", by: ctx.sender, location: origin, timestamp: ctx.timestamp }]
    });
    ctx.log("Product created: " + name);
  },

  updateLocation(ctx, id, location, notes) {
    const key = "product:" + id;
    const product = ctx.get(key);
    if (!product) throw new Error("Product not found: " + id);

    product.history.push({
      action: "location_update",
      by: ctx.sender,
      location: location,
      notes: notes || "",
      timestamp: ctx.timestamp
    });
    product.status = "in_transit";
    ctx.set(key, product);
    ctx.log("Location updated for " + id + ": " + location);
  },

  transferOwnership(ctx, id, newOwner) {
    const key = "product:" + id;
    const product = ctx.get(key);
    if (!product) throw new Error("Product not found: " + id);
    if (product.owner !== ctx.sender) throw new Error("Not the owner");

    const prevOwner = product.owner;
    product.owner = newOwner;
    product.history.push({
      action: "ownership_transfer",
      by: ctx.sender,
      from: prevOwner,
      to: newOwner,
      timestamp: ctx.timestamp
    });
    ctx.set(key, product);
    ctx.log("Ownership transferred: " + prevOwner + " -> " + newOwner);
  },

  markDelivered(ctx, id) {
    const key = "product:" + id;
    const product = ctx.get(key);
    if (!product) throw new Error("Product not found: " + id);

    product.status = "delivered";
    product.history.push({
      action: "delivered",
      by: ctx.sender,
      timestamp: ctx.timestamp
    });
    ctx.set(key, product);
    ctx.log("Product delivered: " + id);
  },

  getProduct(ctx, id) {
    return ctx.get("product:" + id);
  }
}
`;
