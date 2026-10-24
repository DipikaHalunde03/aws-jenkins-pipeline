pipeline {
  agent any

  environment {
    APP = 'aws-devops-webapp'
    TAG = "${env.BUILD_NUMBER}"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        bat 'git log -1 --oneline'
      }
    }

    stage('Validate') {
      steps {
        bat 'if not exist src\\index.html exit /b 1'
        bat 'if not exist src\\style.css exit /b 1'
        bat 'if not exist src\\script.js exit /b 1'
      }
    }

    stage('Build image') {
      steps {
        bat 'docker build -t %APP%:%TAG% .'
      }
    }

    stage('Test container') {
      steps {
        bat 'docker rm -f smoke-test 2>nul || exit /b 0'
        bat 'docker run -d --name smoke-test %APP%:%TAG%'
        sleep 3
        bat 'docker exec smoke-test wget -qO- http://localhost | findstr /C:"<html"'
      }
      post {
        always { bat 'docker rm -f smoke-test 2>nul || exit /b 0' }
      }
    }
  }
}