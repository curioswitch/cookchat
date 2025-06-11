import { atomWithStorage } from "jotai/utils";
import { splitAtom } from "jotai/utils";

export type CartIngredient = {
  name: string;
  quantity: string;
  selected: boolean;
};

export type CartRecipe = {
  id: string;
  title: string;
  servingSize: string;
  ingredients: CartIngredient[];
};

export const cartAtom = atomWithStorage<CartRecipe[]>(
  "shoppingCart",
  [],
  undefined,
  { getOnInit: true },
);
export const cartRecipeAtomsAtom = splitAtom(cartAtom);
