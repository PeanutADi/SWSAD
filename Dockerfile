FROM node:latest
#RUN mkdir /home/node
WORKDIR /home/node/server
RUN cd /home/node \
 &&   git clone --branch gyak https://github.com/2019swsad/server \
 &&   cd server \
 &&   npm install \
 &&   cd app
EXPOSE 8081
ENTRYPOINT ["node", "app/app.js"]
