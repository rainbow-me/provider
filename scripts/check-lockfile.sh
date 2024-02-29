git diff yarn.lock
if ! git diff --exit-code yarn.lock; then
    echo "Changes were detected in yarn.lock file after running 'yarn', which is not expected. Please run 'yarn' locally and commit the changes.";
    exit 1;
fi