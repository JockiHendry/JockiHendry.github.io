# Blog source code

This is the source code for my blog: https://blog.jocki.me

### Development

To run this project in Docker, execute the following command:

    docker build -t jocki/blog . && docker run \
       -p 4000:4000 \
       -v $PWD:/srv/jekyll \
       --name blog \
       jocki/blog

The website can be previewed by visiting http://localhost:4000 in browser.
Changes in files will be reflected in browser immediately (after refreshing
the browser) without the need to re-run docker command again.