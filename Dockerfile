FROM ruby:2.5.3
WORKDIR /srv/jekyll
COPY Gemfile /srv/jekyll
COPY Gemfile.lock /srv/jekyll
RUN bundle install
COPY . /srv/jekyll
EXPOSE 4000
CMD bundle exec jekyll serve --host=0.0.0.0 --watch --force_polling