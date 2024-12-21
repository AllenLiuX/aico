import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

def logger_setup(log_path: Path, debug: bool = False) -> None:
    # create the log directory if not exists
    if not os.path.exists(log_path.parent):
        os.mkdir(log_path.parent)

    # initialize the logging module
    logging.basicConfig(
        filename=log_path,
        level=logging.DEBUG if debug else logging.INFO,
        format="[%(asctime)s] %(levelname)s:%(name)s:%(funcName)s:%(message)s",
        filemode="w",
    )

    logger.info(f"Logging path: {log_path}")