export const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
};

export const getDappHost = (url?: string) => {
  try {
    if (url) {
      const host = new URL(url).host;
      if (host.indexOf('www.') === 0) {
        return host.replace('www.', '');
      }
      return host;
    }
    return '';
  } catch (e) {
    return '';
  }
};
