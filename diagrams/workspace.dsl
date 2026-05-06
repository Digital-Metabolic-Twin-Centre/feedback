workspace "DMTC  Headless Feedback" "Architecture diagrams for the feedback management API service." {

    model {
        apiConsumer = person "API Consumer" "Submits feedback and reads project-scoped feedback threads."
        adminUser = person "Admin User" "Manages feedback, projects, API keys, and reference metadata."
        operator = person "Platform Operator" "Deploys the service, configures secrets, and manages tagged Docker releases."

        gitHubActions = softwareSystem "GitHub Actions" "Builds, tests, and publishes tagged multi-architecture Docker images."
        gitHubContainerRegistry = softwareSystem "GitHub Container Registry" "Stores published Docker images for deployment."
        gitLab = softwareSystem "GitLab" "Receives promoted feedback as issues and follow-up updates."
        smtpProvider = softwareSystem "SMTP Provider" "Delivers notification emails when admins reply to feedback."

        feedbackApi = softwareSystem "DMTC Feedback API" "Next.js-based headless feedback management backend." {
            
            webApi = container "Next.js API Service" "Serves versioned REST endpoints, Swagger docs, bootstrap admin routes, and feedback workflows." "Node.js 22, Next.js 16, TypeScript"

            sqlite = container "SQLite Database" "Embedded SQLite database storing feedback, projects, API keys, messages, audit records, and metadata." "SQLite"

            apiConsumer -> webApi "Uses feedback endpoints via x-api-key over HTTPS"
            adminUser -> webApi "Uses admin feedback and bootstrap management endpoints over HTTPS"

            webApi -> sqlite "Reads and writes application data"

            webApi -> gitLab "Creates and updates promoted issues via API"
            webApi -> smtpProvider "Sends reply notification emails via SMTP"
        }

        operator -> gitHubActions "Pushes branches and version tags"
        operator -> gitHubContainerRegistry "Pulls released Docker images"

        gitHubActions -> gitHubContainerRegistry "Publishes tagged multi-architecture Docker images"

        deploymentEnvironment "docker-deployment" {
            deploymentNode "Host Machine" "Linux server or Apple Silicon Mac running Docker" "Docker Engine" {
                deploymentNode "feedback-app container" "Application container started from the published image" "Container" {
                    containerInstance webApi
                    containerInstance sqlite
                }

                infrastructureNode "feedback_data volume" "Persistent Docker volume mounted at /app/data"
            }
        }
    }

    views {

        systemContext feedbackApi "system-context" "How users and external services interact with the feedback platform." {
            include *
            autoLayout lr
        }

        container feedbackApi "containers" "Runtime containers inside the feedback platform." {
            include *
            autoLayout lr
        }

        deployment feedbackApi "docker-deployment" "docker-view" "Docker-based deployment used locally and in released container images." {
            include *
            autoLayout lr
        }

        styles {

            element "Person" {
                background #0b7285
                color #ffffff
                shape person
                fontSize 33
            }

            element "Software System" {
                background #1971c2
                color #ffffff
                fontSize 32
            }

            element "Container" {
                background #4263eb
                color #ffffff
                fontSize 32
            }

            element "Infrastructure Node" {
                background #495057
                color #ffffff
                fontSize 32
            }

            element "Deployment Node" {
                fontSize 32
            }

        

        }

        theme default
    }
}
