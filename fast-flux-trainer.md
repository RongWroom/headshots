## Basic model info

Model name: replicate/fast-flux-trainer
Model description: Train subjects or styles faster than ever


## Model inputs

- txt: some words (string)


## Model output schema

{
  "type": "string",
  "title": "Output"
}

If the input or output schema includes a format of URI, it is referring to a file.


## Example inputs and outputs

Use these example outputs to better understand the types of inputs the model accepts, and the types of outputs the model returns:

### Example (https://replicate.com/p/extwjt3509rma0cpztp8s799yw)

#### Input

```json
{
  "txt": "hi"
}
```

#### Output

```json
"predict on this model is a no-op"
```


## Model readme

> ### Replicate fast Flux Lora trainer
> 
> Fine-tunes flux, fast! 
> 
> ### How to train:
> 
> Upload a zip file of images that contains the style or subject you want to train the model on.
> 
> Select a `trigger_word` that the model will learn to associate with your subject or style, and select `subject` or `style` as the type of fine-tuning you're trying to run. 
> 
> We'll run an autocaptioning model on the input images that will generate captions which contain your trigger word. You can also provide your own captions. To do so, add a `.txt` file that contains a caption for each image you want to caption in the zip file you upload - for example, `img_0.jpg` would be captioned by `img_0.txt`. 
> 
> For `Destination` select/create an empty Replicate model location to store your LoRAs.
> 
> ### Dataset Size and Image Resolution 
> 
> - Aim for a dataset of 10-20 images of your subject
> - Images with resolutions around 1024x1024 are ideal
> - Very large images will be scaled down to fit aspect ratios around 1024 resolutions
> 
> ### Image selection
> 
> - For style LoRAs select images that highlight distinctive features of the style, use varied subjects but keep the style consistent
> - For style LoRAs avoid datasets where certain elements dominate
> - For character LoRAs use images of the subject in different settings, facial expressions, and backgrounds. 
> - For character LoRAs avoid different haircuts or ages, and showing hands in a lot of face framing positions as we found this led to more hand hallucinations
> 
> ## How to Run your Flux fine tune
> 
> After training is complete you will be able to run your LoRA in a new Replicate model at the `destination` location
> 
> ## How to train with the API
> 
> To run a training from the API, you'll still need to gather a zip file of images and select or create a model on Replicate as the destination for your training. Unlike in the UI, you'll also need to upload the zip file to your storage platform of choice. You'll also need to get a [Replicate API token](https://replicate.com/docs/reference/http#authentication).
> 
> Once you have those things ready, you can call the training API like so:
> 
> ```
> curl -X POST \
>   -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
>   -H "Content-Type: application/json" \
>   -d '{
>         "destination": "your-username/your-model-name",
>         "input": {
>             "input_images": "<your-training-data-url>",
>             "trigger_word": "<some-unique-string>",
>             "lora_type": "subject"
>         }
>     }' \
>   https://api.replicate.com/v1/models/replicate/fast-flux-trainer/versions/8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed/trainings
> ``` 
> 
> This will start the training and return a JSON with training metadata. You can check on the status of the training at [replicate.com/trainings](https://replicate.com/trainings) or programmatically through the API like so: 
> 
> ```
> curl -s \
>   -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
>   https://api.replicate.com/v1/trainings/<training_id>
> ```
