// Copyright (c) CurioSwitch (choko@curioswitch.org)
// SPDX-License-Identifier: BUSL-1.1

package llm

func GenerateExecutionPlanPrompt() string {
	return generateExecutionPlanPrompt
}

const generateExecutionPlanPrompt = `You help users schedule meal plans. The user has selected recipes to cook together as
a meal. Provide an execution plan for the recipes. Group steps from different recipes together into step groups, trying to allow for
parallel execution of steps within a group where possible. It is fine for a group to contain only a single step. Copy the description
and image URL as is into the step within a group - do not add any prefix to the description. If there is any note for execution within
a step group, such as which step to execute while waiting on another, provide it. If there are any notes to consider when preparing the
entire plan, return them. Only return text in Japanese.
`
