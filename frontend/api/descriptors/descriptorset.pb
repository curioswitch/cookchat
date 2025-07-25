
�T
frontendapi/frontend.protofrontendapi"L
ChatContent
message (	H Rmessage
audio (H RaudioB	
payload"�
ChatRequest2
content (2.frontendapi.ChatContentRcontent!
recipe_text (	H R
recipeText
	recipe_id (	H RrecipeIdB
recipe"B
ChatResponse2
content (2.frontendapi.ChatContentRcontent"B
RecipeIngredient
name (	Rname
quantity (	Rquantity"K

RecipeStep 
description (	Rdescription
	image_url (	RimageUrl"j
IngredientSection
title (	Rtitle?
ingredients (2.frontendapi.RecipeIngredientRingredients"�
Recipe
id (	Rid1
source (2.frontendapi.RecipeSourceRsource
title (	Rtitle
	image_url (	RimageUrl 
description (	Rdescription?
ingredients (2.frontendapi.RecipeIngredientRingredientsU
additional_ingredients (2.frontendapi.IngredientSectionRadditionalIngredients-
steps (2.frontendapi.RecipeStepRsteps
notes	 (	Rnotes!
serving_size
 (	RservingSize1
language (2.frontendapi.LanguageRlanguage"/
GetRecipeRequest
	recipe_id (	RrecipeId"_
GetRecipeResponse+
recipe (2.frontendapi.RecipeRrecipe

llm_prompt (	R	llmPrompt"%

Pagination
last_id (	RlastId"l
RecipeSnippet
id (	Rid
title (	Rtitle
summary (	Rsummary
	image_url (	RimageUrl"c
ListRecipesRequest
query (	Rquery7

pagination (2.frontendapi.PaginationR
pagination"�
ListRecipesResponse4
recipes (2.frontendapi.RecipeSnippetRrecipes7

pagination (2.frontendapi.PaginationR
pagination"�
StartChatRequest!
recipe_text (	H R
recipeText
	recipe_id (	H RrecipeIdR
model_provider (2+.frontendapi.StartChatRequest.ModelProviderRmodelProvider

llm_prompt (	R	llmPrompt"k
ModelProvider
MODEL_PROVIDER_UNSPECIFIED 
MODEL_PROVIDER_GOOGLE_GENAI
MODEL_PROVIDER_OPENAIB
recipe"�
StartChatResponse 
chat_api_key (	R
chatApiKey

chat_model (	R	chatModel+
chat_instructions (	RchatInstructions"�
AddRecipeRequest
title (	Rtitle-
main_image_data_url (	RmainImageDataUrl 
description (	Rdescription?
ingredients (2.frontendapi.RecipeIngredientRingredientsU
additional_ingredients (2.frontendapi.IngredientSectionRadditionalIngredientsA
steps (2+.frontendapi.AddRecipeRequest.AddRecipeStepRsteps!
serving_size (	RservingSize1
language (2.frontendapi.LanguageRlanguageW
AddRecipeStep 
description (	Rdescription$
image_data_url (	RimageDataUrl"0
AddRecipeResponse
	recipe_id (	RrecipeId*Q
Language
LANGUAGE_UNSPECIFIED 
LANGUAGE_ENGLISH
LANGUAGE_JAPANESE*H
RecipeSource
RECIPE_SOURCE_UNSPECIFIED 
RECIPE_SOURCE_COOKPAD2N
ChatService?
Chat.frontendapi.ChatRequest.frontendapi.ChatResponse(02�
FrontendServiceJ
	GetRecipe.frontendapi.GetRecipeRequest.frontendapi.GetRecipeResponseP
ListRecipes.frontendapi.ListRecipesRequest .frontendapi.ListRecipesResponseJ
	StartChat.frontendapi.StartChatRequest.frontendapi.StartChatResponseJ
	AddRecipe.frontendapi.AddRecipeRequest.frontendapi.AddRecipeResponseB=Z;github.com/curioswitch/cookchat/frontend/api/go;frontendapiJ�;
  �

  

 

 R
	
 R
,
    The content of a chat message.



 

  

  

  
 A text message.


  



  


  

 
  An audio message.


 	

 


 
*
  A request to send in a chat.




/
 " The content of the chat message.


 

 

 
)
  The recipe to chat about.


 
,
 Free-form text of the recipe.








+
 The ID of a cookchat recipe.








#
! $ A response in a chat.



!
/
 #" The content of the chat message.


 #

 #

 #

 ' * A chat service.



 '
.
  )=! Chat with a stream of messages.


  )


  )

  )

  )(.

  )/;


 , 3


 ,
 
  . Unknown language.


  .

  .

 0
 English.


 0

 0

 2 Japanese.


 2

 2
%
6 ; The source of a recipe.



6

 8  Unknown source.


 8

 8
#
: Recipe from cookpad.


:

:
(
> C An ingredient in a recipe.



>
*
 @ The name of the ingredient.


 @

 @	

 @
@
B3 The quantity of the ingredient as free-form text.


B

B	

B
!
F K A step in a recipe.



F
+
 H The description of the step.


 H

 H	

 H
%
J An image for the step.


J

J	

J
3
N S' A section of ingredients in a recipe.



N
3
 P& The title of the ingredient section.


 P

 P	

 P
.
R,! The ingredients in the section.


R


R

R'

R*+
'
V w Full details of a recipe.



V
C
 X6 The unique identifier of the recipe within cookchat.


 X

 X	

 X
(
[ The source of the recipe.


[

[

[
'
^ The title of the recipe.


^

^	

^
8
a+ The URL for the main image of the recipe.


a

a	

a
-
d  The description of the recipe.


d

d	

d
2
g,% The main ingredients of the recipe.


g


g

g'

g*+
<
j8/ Additional ingredients grouped into sections.


j


j

j3

j67
/
m " The steps to prepare the recipe.


m


m

m

m
=
p0 Additional notes or comments about the recipe.


p

p	

p
@
	s3 The serving size of the recipe as free-form text.


	s

	s	

	s
*

v The language of the recipe.



v



v


v
6
z }* A request for FrontendService.GetRecipe.



z
+
 | The ID of the recipe to get.


 |

 |	

 |
9
� �+ A response for FrontendService.GetRecipe.


�
%
 � The requested recipe.


 �

 �	

 �
p
�b The LLM prompt used to interact with the recipe.
 Only returned for users with debugging access.


�

�	

�
H
	� �: A token returned to retrieve a subsequent page of items.


	�

	 �

	 �

	 �	

	 �
5

� �' A snippet of a recipe for list views.



�
%

 � The ID of the recipe.



 �


 �	


 �
(

� The title of the recipe.



�


�	


�
*

� The summary of the recipe.



�


�	


�
,

� The image URL of the recipe.



�


�	


�
:
� �, A request for FrontendService.ListRecipes.


�
*
 � A text query to filter by.


 �

 �	

 �
i
�[ The pagination token for the next page of recipes.
 If unset, the first page is returned.


�

�

�
;
� �- A response for FrontendService.ListRecipes.


�

 �% The recipes.


 �


 �

 � 

 �#$
B
�4 The pagination token for the next page of recipes.


�

�

�
2
� �$ A request to start a chat session.


�
+
 �� The recipe to chat about.


 �
-
 � Free-form text of the recipe.


 �


 �

 �
,
� The ID of a cookchat recipe.


�


�

�

 ��

 �
$
  �# The default model.


  �

  �!"
%
 �$ Google GenAI model.


 �

 �"#

 � OpenAI model.


 �

 �
7
�#) The model provider to use for the chat.


�

�

�!"
b
�T The prompt to use with the chat.
 Only recognized for users with debugging access.


�

�	

�
3
� �% A response to start a chat session.


�
?
 �1 The ephemeral API key to use to start the chat.


 �

 �	

 �
6
�( The chat model to use for the session.


�

�	

�
2
�$ Instructions for the chat session.


�

�	

�

� �

�
(
 � The title of the recipe.


 �

 �	

 �
<
�!. The main image of the recipe, as a data URL.


�

�	

� 
.
�  The description of the recipe.


�

�	

�
3
�,% The main ingredients of the recipe.


�


�

�'

�*+
=
�8/ Additional ingredients grouped into sections.


�


�

�3

�67

 ��

 �

.
  � The description of the step.


  �


  �

  �
7
 �' An image for the step, as a data URL.


 �


 �

 �
0
�#" The steps to prepare the recipe.


�


�

�

�!"
A
�3 The serving size of the recipe as free-form text.


�

�	

�
+
� The language of the recipe.


�


�

�

� �

�
1
 �# The ID of the newly added recipe.


 �

 �	

 �

� �

�
5
 �>' Get the recipe for a given recipe ID.


 �

 � 

 �+<
(
�D Get the list of recipes.


�

�$

�/B
%
�> Start a chat session.


�

� 

�+<
!
�> Add a new recipe.


�

� 

�+<bproto3