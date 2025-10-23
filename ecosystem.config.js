module.exports = {
  apps: [
    {
      name: "ekoebrand",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
