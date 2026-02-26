# Design a Suitable Project Structure
I am building a Styling Assistant where user can provide multi-modal inputs along with optional radio-button based questionnaire and get product recommendations to create outfits with products from our vector database in qdrant (queries via API).

## Execution Flows

### v1
1. We’ll have a simple chat interface page where the user will be asked to fill out an optional questionnaire at the beginning of the chat and provide other details such as text describing what he wants and is aiming to receive along with any number of images.
2. Then all those input details will be fed to an expert LLM to construct a query for qdrant search API. 
3. Lastly, the results of the search API will be given to a larger more intelligent VM to create the final response for user based on his input and grounding the visual cues in what we fetched from qdrant 

### v2
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

## Project Structure Requirements
- Dedicated places for backend & frontend code
- Easy to start both (UI & Supporting Backend) services using a shell script is preferred
- Dedicated places to implement individual steps such as (User Input Processing, qDrant Query Generation, qDrant Query Responses, Final Response generation) testing files.
    - It'll easier to test a dedicated HTML files with minimal design.
- Separate folder for documentations
- The testing files should use the same utility functions used by actual execution flow.
