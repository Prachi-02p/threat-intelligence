pipeline {
    agent any

    stages {

        stage('Clean Workspace') {
            steps {
                deleteDir()
            }
        }

        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Prachi-02p/threat-intelligence.git'
            }
        }

        stage('Create Environment File') {
            steps {
                bat '''
                if exist .env.example (
                    copy .env.example .env
                ) else (
                    echo ERROR: .env.example not found
                    exit 1
                )
                '''
            }
        }

        stage('Build Docker Images') {
            steps {
                bat 'docker compose build'
            }
        }

        stage('Deploy Application') {
            steps {
                bat '''
                docker compose down || exit 0
                docker compose up -d
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD pipeline completed successfully'
        }
        failure {
            echo 'CI/CD pipeline failed'
        }
    }
}
