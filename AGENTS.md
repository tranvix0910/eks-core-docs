# Repository workflow

- After completing code changes, run the relevant checks, create a Git commit, and push it to the current branch's remote. This is the user's standing preference; do not ask for confirmation each time.
- Commit the completed changes for the requested work, including any required assets. Preserve unrelated user changes and never overwrite remote work or force-push without explicit authorization.
- Report the commit and push result when handing the work back. If a check or push fails, explain the concrete failure instead of claiming completion.

## Vietnamese workshop writing

- Follow the user's writing in https://github.com/tranvix0910/ws-002: explain the component, show its role in this project, then walk through the commands and results.
- Use natural Vietnamese sentences. Keep familiar technical terms such as cluster, node, Pod, replica, Helm chart, scheduling, eviction, metrics and logs. Do not capitalize ordinary English words throughout prose or replace normal Vietnamese with English labels.
- Introduce theory before the related lab. Use concrete examples from this repository instead of generic product praise or repeated claims about proving requirements.
- Check implementation details against the current Terraform, GitOps and apps repositories. The reference workshop is a writing reference; do not copy its different tools or architecture into this workshop.
- Preserve working commands, resource identifiers, routes and screenshots. Keep the existing English docs and shared homepage, navbar and footer unchanged when the task concerns Vietnamese workshop content.

## Application naming

- Refer to the deployed application as microservices, the project app, or ứng dụng in visible workshop text, navigation and architecture diagrams. Avoid application product branding.
- Keep existing namespace, image repository, resource and path identifiers in executable examples aligned with the implementation repositories. A display-name change must not silently rename deployed resources.
