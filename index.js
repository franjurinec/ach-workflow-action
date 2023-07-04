const core = require('@actions/core');
const fetch = require('node-fetch')
const fs = require('fs');

async function run() {
  try {
    const INVENIO_API_URL = core.getInput('invenio-url');
    const INVENIO_API_KEY = core.getInput('invenio-key');
    const ROOT_RECORD = core.getInput('invenio-root-id');
    const METADATA_FILE = core.getInput('metadata-file');

    const authHeaders = {
      Authorization: `Bearer ${INVENIO_API_KEY}`
    }

    // Get or create new draft from root record
    let draft = await fetch(new URL(`/api/records/${ROOT_RECORD}/draft`, INVENIO_API_URL), {
      headers: authHeaders
    }).then(res => res.json())

    console.log(draft)

    if (draft.status === 404) {
      draft = await fetch(new URL(`/api/records/${ROOT_RECORD}/versions`, INVENIO_API_URL), {
        headers: authHeaders,
        method: 'POST'
      }).then(res => res.json())
    }

    console.log(draft)

    // Update record using metadata
    metadataBuffer = fs.readFileSync(METADATA_FILE)
    metadata = JSON.parse(metadataBuffer)
    console.log(metadata)
    draft = await fetch(new URL(`/api/records/${draft.id}/draft`, INVENIO_API_URL), {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      method: 'PUT',
      body: {
        "access": {"record": "public", "files": "public"},
        // "files": {"enabled": False},
        "metadata": {
            "title": metadata.title,
            "description": metadata.description,
            "publication_date": new Date()
                                  .toISOString()
                                  .split("T")[0],
            "creators": [
                {
                    "person_or_org": {
                        "family_name": metadata.authors[0].surname,
                        "given_name": metadata.authors[0].name,
                        "type": "personal",
                    },
                },
            ],
            "resource_type": {"id": "dataset"},
        },
    }
    }).then(res => res.json())

    console.log(draft)

    record = await fetch(new URL(`/api/records/${draft.id}/draft/actions/publish`, INVENIO_API_URL), {
      headers: authHeaders,
      method: 'POST'
    }).then(res => res.json())

    console.log(record)

    core.setOutput('record', new URL(`/records/${record.id}`, INVENIO_API_URL).toString())
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()