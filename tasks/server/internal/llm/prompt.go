// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package llm

func GenerateExecutionPlanPrompt() string {
	return generateExecutionPlanPrompt
}

const generateExecutionPlanPrompt = `You help users schedule meal plans. The user has selected recipes to cook together as
a meal. Provide an execution plan for the recipes. Group steps from different recipes together into step groups, trying to allow for
parallel execution of steps within a group where possible. It is fine for a group to contain only a single step. For each output step,
return only the recipeId and the zero-based stepIndex from the input recipe's content.steps array. Do not return or rewrite the step
description or image URL. Do not include the same recipeId and stepIndex more than once. If there is any note for execution within
a step group, such as which step to execute while waiting on another, provide it. If there are any notes to consider when preparing the
entire plan, return them. Only return text in Japanese.
`
