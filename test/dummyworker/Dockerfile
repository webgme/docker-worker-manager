# Docker file for testing (uses dummyworker)
#
# $ docker build -t webgme-dummy-docker-worker:<PACKAGE_JSON_VERSION> .

# https://github.com/nodejs/docker-node/blob/3b038b8a1ac8f65e3d368bedb9f979884342fdcb/6.9/Dockerfile
FROM node:boron
RUN mkdir /usr/app

WORKDIR /usr/app

# copy dockerworker
ADD dummyworker.js /usr/app/dockerworker.js