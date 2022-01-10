import process from "process";
import { GraphQLClient } from "graphql-request";
import fetch from "node-fetch";
import { gray, green, red, yellow, yellowBright } from "ansi-colors";
import { getSdk } from "./graphql.generated";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .command(
    [
      "migrate <organization> <repository> <projectNumber> <projectNextNumber>",
      "$0 <organization> <repository> <projectNumber> <projectNextNumber>",
    ],
    "migrate a repo-level Project board to an organization-level Project (next)",
    (argv) =>
      argv
        .positional("organization", {
          describe:
            "Github organization that owns the repo and the project (beta) board",
          type: "string",
        })
        .positional("repository", {
          describe: "Github repository that contains the project to migrate",
          type: "string",
        })
        .positional("projectNumber", {
          describe: "Number of the project to migrate",
          type: "number",
        })
        .positional("projectNextNumber", {
          describe: "Number of the project (beta) to migrate into",
          type: "number",
        })
  )
  .parseSync();

const { organization, repository, projectNumber, projectNextNumber } = argv;

if (!process.env.GITHUB_TOKEN) {
  console.log(
    yellowBright(
      "Please set the GITHUB_TOKEN environment variable to a token with organization:write access."
    )
  );
}

const client = new GraphQLClient("https://api.github.com/graphql", {
  fetch,
  headers: {
    Authorization: `bearer ${process.env.GITHUB_TOKEN}`,
  },
});
const sdk = getSdk(client);

async function migrate() {
  const data = await sdk.GetProjectDataQuery({
    organization,
    repository,
    projectNumber,
    projectNextNumber,
  });

  const projectNextId = data.organization.projectNext.id;
  const statusField = data.organization.projectNext.fields.nodes.find(
    (node) => node.name === "Status"
  );
  const statusFieldId = statusField.id;
  const statusFieldOptions = JSON.parse(statusField.settings).options;

  for (const column of data.repository.project.columns.nodes) {
    const normalizedName = column.name.replace(" ", "").toLowerCase();
    const matchingStatus = statusFieldOptions.find(
      (option) => option.name.replace(" ", "").toLowerCase() === normalizedName
    );
    console.log(
      yellowBright(
        `Migrating items from ${red(column.name)} column to ${green(
          matchingStatus.name
        )} status`
      )
    );

    for (const card of column.cards.nodes) {
      console.log(
        `Migrating ${yellow(
          `${card.content.__typename} #${card.content.number}`
        )}: ${gray(card.content.title)}`
      );
      const newItemData = await sdk.AddItemMutation({
        projectId: projectNextId,
        contentId: card.content.id,
      });
      const itemId = newItemData.addProjectNextItem.projectNextItem.id;
      await sdk.UpdateItemStatusMutation({
        projectId: projectNextId,
        itemId,
        statusFieldId,
        value: matchingStatus.id,
      });
    }
  }
}

migrate().catch((err) => console.error(`${red(err.message)}`));
