FROM osixia/openldap:1.5.0

# Bake the seed into the image so osixia can delete bootstrap files after setup
# (bind mounts cannot be removed and previously turned into empty directories).
COPY bootstrap/50-seed.ldif /container/service/slapd/assets/config/bootstrap/ldif/custom/50-seed.ldif
