/**
 * Local dev data: `pnpm db:seed`, also run by `pnpm db:reset`. Never run in
 * production. Sellers can't sign in (their numbers aren't test numbers):
 * sign in as +223 70 00 00 00 with TEST_PHONE_CODE to browse and sell.
 */
import { config } from "dotenv";
import { loadConfig } from "../src/config.js";
import { hashPhone } from "../src/lib/phone-hash.js";
import { createPrisma } from "../src/lib/prisma.js";

config({ path: "../../.env", quiet: true });
const env = loadConfig();
if (env.NODE_ENV === "production")
  throw new Error("The seed never runs in production");

const prisma = createPrisma(env.DATABASE_URL);
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600 * 1000);

const categories = [
  { slug: "designers", name: "Designers", position: 1 },
  { slug: "electronics", name: "Electronics", position: 2 },
  { slug: "clothing", name: "Clothing", position: 3 },
  { slug: "shoes", name: "Shoes", position: 4 },
  { slug: "bags", name: "Bags", position: 5 },
];

const sellers = [
  {
    n: 1,
    fullName: "Aïcha Traoré",
    avatar: 762020,
    neighbourhood: "Hamdallaye ACI",
  },
  {
    n: 2,
    fullName: "Mamadou Diallo",
    avatar: 614810,
    neighbourhood: "Badalabougou",
  },
  {
    n: 3,
    fullName: "Fatou Koné",
    avatar: 733872,
    neighbourhood: "Kalaban Coura",
  },
  {
    n: 4,
    fullName: "Ibrahim Touré",
    avatar: 2379004,
    neighbourhood: "Lafiabougou",
  },
  {
    n: 5,
    fullName: "Sira Coulibaly",
    avatar: 415829,
    neighbourhood: "Baco Djicoroni",
  },
  { n: 6, fullName: "Yacouba Sanogo", avatar: 91227, neighbourhood: null },
] as const;

const sellerId = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

// likesCount set directly: the mock counts have no matching users
const products = [
  {
    n: 1,
    seller: 1,
    category: "clothing",
    title: "Vintage Denim Jacket",
    price: 23000,
    size: "M",
    condition: "like_new",
    likes: 12,
    hours: 1,
    image: 13662420,
    description:
      "Authentic 90s denim, slightly worn for that perfect look. Size M but fits like an L.",
  },
  {
    n: 2,
    seller: 2,
    category: "shoes",
    title: "Nike Air Force 1",
    price: 17200,
    size: "42",
    condition: "used",
    likes: 34,
    hours: 3,
    image: 1598505,
    description:
      "Worn a few times, soles in good shape. Comes with the original box.",
  },
  {
    n: 3,
    seller: 3,
    category: "designers",
    title: "Minimalist Leather Handbag",
    price: 35000,
    size: "One size",
    condition: "new",
    likes: 5,
    hours: 5,
    image: 1152077,
    description: "Genuine leather, never used. Fits a phone, wallet and keys.",
  },
  {
    n: 4,
    seller: 4,
    category: "clothing",
    title: "Oversized Hoodie",
    price: 40000,
    size: "L",
    condition: "good",
    likes: 0,
    hours: 24,
    image: 9367505,
    description: null,
  },
  {
    n: 5,
    seller: 5,
    category: "designers",
    title: "Summer Floral Dress",
    price: 28000,
    size: "S",
    condition: "like_new",
    likes: 10,
    hours: 48,
    image: 19895983,
    description:
      "Light cotton, perfect for the hot season. Worn once for a wedding.",
  },
  {
    n: 6,
    seller: 6,
    category: "shoes",
    title: "Casual Canvas Sneakers",
    price: 32000,
    size: "43",
    condition: "used",
    likes: 20,
    hours: 72,
    image: 2529148,
    description: null,
  },
] as const;

await prisma.$transaction(async (tx) => {
  for (const category of categories) {
    await tx.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }

  for (const seller of sellers) {
    const phone = `+2237600000${seller.n}`;
    await tx.user.upsert({
      where: { id: sellerId(seller.n) },
      update: {},
      create: {
        id: sellerId(seller.n),
        phoneE164: phone,
        phoneHash: hashPhone(phone, env.PHONE_HASH_PEPPER),
        fullName: seller.fullName,
        avatarPath: pexels(seller.avatar),
        neighbourhood: seller.neighbourhood,
      },
    });
  }

  for (const product of products) {
    const id = `10000000-0000-4000-8000-00000000000${product.n}`;
    const category = await tx.category.findUniqueOrThrow({
      where: { slug: product.category },
    });
    await tx.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        sellerId: sellerId(product.seller),
        categoryId: category.id,
        title: product.title,
        description: product.description,
        price: product.price,
        size: product.size,
        condition: product.condition,
        likesCount: product.likes,
        createdAt: hoursAgo(product.hours),
        images: { create: [{ path: pexels(product.image), position: 0 }] },
      },
    });
  }
});

console.log(
  `Seeded ${categories.length} categories, ${sellers.length} sellers, ${products.length} products.`,
);
await prisma.$disconnect();
