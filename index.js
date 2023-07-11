const core = require('@actions/core');
const fetch = require('node-fetch')
const fs = require('fs');
const path = require('path')

async function run() {
  try {
    const INVENIO_API_URL = core.getInput('invenio-url');
    const INVENIO_API_KEY = core.getInput('invenio-key');
    const ROOT_RECORD = core.getInput('invenio-root-id');
    const METADATA_DIR = core.getInput('metadata-dir');

    const authHeaders = {
      Authorization: `Bearer ${INVENIO_API_KEY}`
    }

    // Get or create new draft from root record
    let draft = await fetch(new URL(`/api/records/${ROOT_RECORD}/draft`, INVENIO_API_URL), {
      headers: authHeaders
    }).then(res => res.json())
    if (draft.status === 404) {
      draft = await fetch(new URL(`/api/records/${ROOT_RECORD}/versions`, INVENIO_API_URL), {
        headers: authHeaders,
        method: 'POST'
      }).then(res => res.json())
    }

    // Prepare Metadata
    metadata = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, 'metadata.json')))
    metadata.source = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, 'source_meta.json')))
    metadata.source.pulses = fs.readdirSync(path.join(METADATA_DIR, 'in_pulses')).map((file) => JSON.parse(fs.readFileSync(path.join(METADATA_DIR, `in_pulses/${file}`))))
    metadata.output = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, 'output_meta.json')))
    recordData = {
        "access": {"record": "public", "files": "public"},
        "files": {"enabled": true}, // Only when no files are present
        "metadata": {
            "title": metadata.title,
            "description": `${metadata.description} \n ${metadata.output["access_instructions"]}`,
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

    // Update Draft
    draft = await fetch(new URL(`/api/records/${draft.id}/draft`, INVENIO_API_URL), {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      method: 'PUT',
      body: JSON.stringify(recordData)
    }).then(res => res.json())

    // Attach Metadata File
    await fetch(new URL(`/api/records/${draft.id}/draft/files`, INVENIO_API_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(['metadata.json'])
    })

    await fetch(new URL(`/api/records/${draft.id}/draft/files/metadata.json/content`, INVENIO_API_URL), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...authHeaders
      },
      body: Buffer.from(JSON.stringify(metadata, null, 4))
    })

    await fetch(new URL(`/api/records/${draft.id}/draft/files/metadata.json/commit`, INVENIO_API_URL), {
      method: 'POST',
      headers: authHeaders
    })

    // Publish Draft
    record = await fetch(new URL(`/api/records/${draft.id}/draft/actions/publish`, INVENIO_API_URL), {
      headers: authHeaders,
      method: 'POST'
    }).then(res => res.json())

    // Generate error in case of failure
    if (typeof record.status === 'number') throw new Error('Failed to publish record.')

    // Output link 
    core.setOutput('record', record.links.self)
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()
