# Docker Setup

To run this application using Docker, use the following command:

```bash
docker run -d \
  -p 8000:8000 \
  --name headshots \
  -e REPLICATE_API_TOKEN=your_replicate_api_token_here \
  headshot-service:latest
```

## Command Breakdown:
- `-d`: Run the container in detached mode (in the background)
- `-p 3000:3000`: Map port 3000 of the container to port 3000 on the host
- `--name headshots`: Assign a name to the container
- `a55112529891`: The Docker image ID (first 12 characters of the full ID)

## Verifying the Container
To check if the container is running:
```bash
docker ps
```

## Stopping the Container
When you want to stop the container:
```bash
docker stop headshots
```

## Starting the Container Again
To start the container after it has been stopped:
```bash
docker start headshots
```

## Viewing Logs
To view the application logs:
```bash
docker logs headshots
```