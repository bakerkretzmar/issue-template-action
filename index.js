const core = require('@actions/core');
const fs = require('fs');
const github = require('@actions/github');
const mdjson = require('mdjson');
const wait = require('./wait');

const ISSUE_TEMPLATE_DIR = '.github/ISSUE_TEMPLATE';

(async () => {
    const { payload } = github.context;
    const client = new github.GitHub(core.getInput('github-token', { required: true }));
    const label = core.getInput('closed-issue-label');

    const headings = Object.keys(mdjson(payload.issue.body));
    const templates = fs.readdirSync(ISSUE_TEMPLATE_DIR);

    const valid = templates.some((template) => {
        const md = fs.readFileSync(`${ISSUE_TEMPLATE_DIR}/${template}`, 'utf-8');
        return Object.keys(mdjson(md)).every((title) => headings.includes(title));
    });

    const issue = {
        owner: payload.issue.owner,
        repo: payload.issue.repo,
        issue_number: payload.issue.number,
    };

    if (valid || payload.action !== 'opened') {
        // Only reopen the issue if there's a `closed-issues-label` so it knows that
        // it was previously closed because of the wrong template
        if (payload.issue.state === 'closed' && label) {
            const labels = (await client.issues.listLabelsOnIssue(issue)).data.map(({ name }) => name);

            if (!labels.includes(label)) {
                return;
            }

            await client.issues.removeLabel({ name: label, ...issue });
            await client.issues.update({ state: 'open', ...issue });
            return;
        }

        return;
    }

    if (label) {
        await client.issues.addLabels({ labels: [label], ...issue });
    }

    const message = `Hi @${github.context.payload.issue.user.login} :wave:\n\nThis issue is being automatically closed because it does not follow the issue template.`;

    await client.issues.createComment({ body: getIssueCloseMessage(), ...issue });
    await client.issues.update({ state: 'closed', ...issue });
})();
