# Project Requirement
An Styling assistant for personal styling based on user's requirements (multi-modal) and existing clothes in the wardrobe by recommending the products from Scout or any other live shoppable source.

## Execution Flow
Main steps:- 
User Input Processing (if images are present) 
-> Pass the constructed input query json to an intelligent LLM for analysing requirements, images & defining qdrant text queries to find required products if any are necessary
-> Provide the reasoning behind qdrant query creation along with the search results (includes pdp_url, image, metadata) for all queries to a suitable LLM for generating the final response with outfits, insights, & reasoning behind the creation of those outfits.

1. First at user input: Department (men/women) + Prompt (describes what user wants) + Preferences (Used to narrow down the criteria based on Material, Fit, Occastion, etc.) (OPTIONAL) + Images (OPTIONAL)
2. If user input has images, process & construct below dict input for the further processing:
{
    "prompt": "",
    "preferences": {

    },
    "image1": {
        "slug": "",
        "meta": {
            # Gathered Image attributes
        },
        "url": "" # Downloadable image url
    },
    ...
}
else the dict input for further processing will look like: 
{
    "prompt": "",
    "preferences": {

    }
}
3. Based on the input from step 2, understand the requirement, & construct qdrant queries if any external products are required (when necessary products are not available with the user)
4. If some products need to looked up from qdrant then fetch them otherwise move to step 5.
5. Analyze step 3 reasoning, step 4 results if any and prepare a final response with outfits combining products images from input & qdrant products (based on the reasoning & explanation generated in step 3) to return suitable outfits to the user with helpful reasoning, explanation & insights in a clean response.

## User inputs:
1. Department: men or women
2. Prompt: Describing what user wants the outfits like, for what purpose & any other inputs that outfiting logic shoiuld take into consideration.
3. Preferences: This is OPTIONAL, by default we don't want to narrow down search criteria. But user is allowed to select multiple vales in check boxes for Material, Fit & Occasion. The LOVs are defined below:
Occasion: casual, party, everyday, workwear, elevated
Fit: regular, skinny, oversized, comfort, slim
Material: cotton, silk, polyester, nylon, linen
4. Images: User can upload any images of clothing items.

## System Restrictions
- Target categories are restricted to Shirts, T-shirts, Trousers, Shorts, Jackets
- The Image similarity search only accepts a single image input, but since we wouldn't what type of images to look for we'll be searching products using detailed & very specific description.
    - Since the qdrant search will return products closed to the input search vector, we may or may not find an expeted products. Hence, during the last step the search shouldn't be treated as the absolute fit, but rather re-analysed against the initial reasoning & only best suitable outfits to user input should be shown.
- For all LLM calls API based integration are to be used strictly by the backend codebase. For frontend, the requirement is only to follow the execution flow in the steps mentione above using the endpoint implemented for the same in the backend.
- Testing steps utility should use the actual utility shared with production code, and only provide a simple UI to use it instead of importing those functions within the code.
