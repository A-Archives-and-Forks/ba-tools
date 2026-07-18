type ClerkMetadataContainer = {
  publicMetadata?: unknown;
  privateMetadata?: unknown;
  unsafeMetadata?: unknown;
};

function hasSuperUserFlag(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "isSuperUser" in metadata &&
    metadata.isSuperUser === true
  );
}

export function isSuperUser(user: ClerkMetadataContainer | null | undefined) {
  return (
    hasSuperUserFlag(user?.publicMetadata) ||
    hasSuperUserFlag(user?.privateMetadata) ||
    hasSuperUserFlag(user?.unsafeMetadata)
  );
}
