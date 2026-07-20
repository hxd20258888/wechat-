export type TempAvatarUrlResolver = (fileID: string) => Promise<string>;

export async function resolveAvatarForDisplay(
  avatar: string,
  resolveTempUrl: TempAvatarUrlResolver
) {
  if (!avatar || avatar === 'default') {
    return '';
  }

  if (!avatar.startsWith('cloud://')) {
    return avatar;
  }

  return resolveTempUrl(avatar);
}
