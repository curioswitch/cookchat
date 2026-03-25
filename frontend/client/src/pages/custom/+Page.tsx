import { TextArea } from "@heroui/react";
import { useCallback, useState } from "react";

import ChatButton from "./ChatButton";

export default function Page() {
  const [recipeText, setRecipeText] = useState("");

  const navigateToStep = useCallback(() => {}, []);
  const onRecipeTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRecipeText(e.target.value);
    },
    [],
  );

  return (
    <div className="p-10">
      <h1 className="text-center">Let's cook!</h1>
      <div className="flex flex-col gap-4">
        <div>
          <TextArea
            name="recipe"
            placeholder="Enter recipe"
            onChange={onRecipeTextChange}
          />
        </div>
        <ChatButton recipeText={recipeText} navigateToStep={navigateToStep} />
      </div>
    </div>
  );
}
