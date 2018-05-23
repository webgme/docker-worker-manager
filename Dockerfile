# This will build the necessary webgme needed for plugin execution.
# Note! If you have any other dependencies (in addition to node-modules) make sure to
# add the neccessary steps to bundle these within the image.
#
# 1. Copy this file to the root of your webgme repository (a clean copy, no node_modules, blobstorage etc.)
# 2. Build the image
#     $ docker build -t webgme-docker-worker .

# https://github.com/nodejs/docker-node/blob/3b038b8a1ac8f65e3d368bedb9f979884342fdcb/6.9/Dockerfile
FROM node:boron

RUN mkdir /usr/app

WORKDIR /usr/app

# copy app source
ADD . /usr/app/

# Install the node-modules.
RUN npm install

# Needed only if webgme is a peerDependency
RUN npm install webgme

# Uncomment this line if webgme-docker-worker-manager is a node_module (which is probably is).
# RUN cp /usr/app/node_modules/webgme-docker-worker-manager/dockerworker.js /usr/app/dockerworker.js