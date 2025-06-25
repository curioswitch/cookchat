import { Textarea } from "@heroui/input";
import { useCallback, useState } from "react";

import ChatButton from "./ChatButton";

export default function Page() {
  const [recipeText, setRecipeText] = useState("");

  const navigateToStep = useCallback(() => {}, []);

  return (
    <div className="p-10">
      <h1 className="text-center">Let's cook!</h1>
      <div className="flex flex-col gap-4">
        <div>
          <Textarea
            name="recipe"
            placeholder="Enter recipe"
            onValueChange={setRecipeText}
          />
        </div>
        <ChatButton recipeText={recipeText} navigateToStep={navigateToStep} />
      </div>
    </div>
  );
}
