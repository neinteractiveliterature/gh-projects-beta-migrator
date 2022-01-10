module.exports = {
  schema: {
    "https://api.github.com/graphql": {
      headers: `Authorization: bearer ${process.env.GITHUB_TOKEN}`,
    },
  },
};
